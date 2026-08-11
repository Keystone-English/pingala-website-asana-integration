const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const axios = require("axios");

exports.syncAsanaTasks = onRequest({ region: "australia-southeast1" }, async (req, res) => {
  const secret = req.headers["x-hook-secret"];
  if (secret) {
    logger.info("Asana webhook handshake received");
    res.setHeader("X-Hook-Secret", secret);
    return res.status(200).send();
  }

  const events = req.body.events;
  if (!events || !Array.isArray(events) || events.length === 0) {
    return res.status(200).send();
  }

  const asanaPat = process.env.ASANA_ACCESS_TOKEN;
  if (!asanaPat) {
    logger.error("ASANA_ACCESS_TOKEN not set in environment");
    return res.status(500).send();
  }

  const taskIds = new Set();
  for (const event of events) {
    const resourceType = event.resource?.resource_type;
    if (resourceType === "task") {
      taskIds.add(event.resource.gid);
    } else if (resourceType === "story" && event.parent?.resource_type === "task") {
      taskIds.add(event.parent.gid);
    }
  }

  try {
    for (const taskId of taskIds) {
      const taskResponse = await axios.get(
        `https://app.asana.com/api/1.0/tasks/${taskId}`,
        {
          params: { opt_fields: "name,notes,completed,permalink_url,memberships.section.name" },
          headers: { Authorization: `Bearer ${asanaPat}` }
        }
      );

      const taskData = taskResponse.data.data;
      if (!taskData) continue;

      if (taskData.completed) {
        await db.collection("public_asana_tasks").doc(taskId).delete();
        continue;
      }

      const sectionName = taskData.memberships?.[0]?.section?.name || "Active";
      const approvedComments = await fetchApprovedComments(taskId, asanaPat);
      const imageUrl = await fetchFirstImageUrl(taskId, asanaPat);

      const cleanDescription = (taskData.notes || "")
        .replace(/https:\/\/app\.asana\.com\/app\/asana\/-\/get_asset\?asset_id=[^\s]*/g, "")
        .replace(/https:\/\/asanausercontent\.com\/[^\s]*/g, "")
        .trim();

      await db.collection("public_asana_tasks").doc(taskId).set({
        name:             taskData.name,
        description:      cleanDescription,
        status:           sectionName,
        permalink:        taskData.permalink_url || "",
        approvedComments: approvedComments,
        imageUrl:         imageUrl || "",
        lastUpdated:      admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    logger.error("Error syncing tasks from Asana", error.response?.data || error.message);
  }

  res.status(200).send();
});

async function fetchFirstImageUrl(taskId, asanaPat) {
  try {
    const attachmentsResponse = await axios.get(
      `https://app.asana.com/api/1.0/tasks/${taskId}/attachments`,
      {
        params: { opt_fields: "name,download_url,host,resource_type" },
        headers: { Authorization: `Bearer ${asanaPat}` }
      }
    );

    const attachments = attachmentsResponse.data.data || [];
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const imageAttachment = attachments.find(a =>
      a.download_url && imageExts.some(ext => a.name?.toLowerCase().endsWith(ext))
    );

    return imageAttachment ? imageAttachment.download_url : null;
  } catch (err) {
    return null;
  }
}

async function fetchApprovedComments(taskId, asanaPat) {
  const storiesResponse = await axios.get(
    `https://app.asana.com/api/1.0/tasks/${taskId}/stories`,
    {
      params: { opt_fields: "text,type,reaction_summary,resource_subtype,created_at" },
      headers: { Authorization: `Bearer ${asanaPat}` }
    }
  );

  const stories = storiesResponse.data.data || [];
  const approved = [];

  for (const story of stories) {
    if (story.type !== "comment") continue;
    if (!story.text || !story.text.startsWith("[Community Web Comment]")) continue;

    const hasApproval = story.reaction_summary?.some(r => r.emoji_base === "✅");
    if (!hasApproval) continue;

    const parts = story.text.split("\n\n");
    const header = parts[0];
    const commentText = parts.slice(1).join("\n\n").trim();
    const nameMatch = header.match(/From:\s*([^(]+)/);
    const name = nameMatch ? nameMatch[1].trim() : "Community Member";

    approved.push({
      gid:       story.gid,
      name:      name,
      text:      commentText,
      createdAt: story.created_at || ""
    });
  }

  return approved;
}

exports.postCommunityComment = onRequest({ region: "australia-southeast1", cors: true }, async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { asanaTaskId, userName, userEmail, commentText } = req.body;

    if (!asanaTaskId || !userName || !userEmail || !commentText) {
      return res.status(400).send("Missing required fields");
    }

    const asanaPat = process.env.ASANA_ACCESS_TOKEN;
    if (!asanaPat) {
       logger.error("Asana PAT not found in environment");
       return res.status(500).send("Server configuration error");
    }

    const formattedComment = `[Community Web Comment] From: ${userName} (${userEmail})\n\n${commentText}`;

    try {
      await axios.post(
        `https://app.asana.com/api/1.0/tasks/${asanaTaskId}/stories`,
        { data: { text: formattedComment } },
        { headers: { Authorization: `Bearer ${asanaPat}`, "Content-Type": "application/json" } }
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error posting to Asana", error.response?.data || error.message);
      return res.status(500).json({ 
        message: "Failed to post comment to Asana", 
        error: error.response?.data?.errors || error.message 
      });
    }
});
