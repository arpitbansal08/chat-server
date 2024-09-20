import express from "express";
import {
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChat,
  getMyGroups,
  leaveGroup,
  newGroupChat,
  removeMember,
  renameGroup,
  sendAttachments,
} from "../controllers/chat.js";
import {
  addMemberValidator,
  chatIdValidator,
  newGroupChatValidator,
  removeMemberValidator,
  renameGroupValidator,
  sendAttachmentsValidator,
  validateHandler,
} from "../lib/validators.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { attachmentsMulter } from "../middlewares/multer.js";

const app = express.Router();

// After here user must be logged in to access the routes
app.use(isAuthenticated);
app.post("/new", newGroupChatValidator(), validateHandler, newGroupChat);
app.get("/my", getMyChat);
app.get("/my/groups", getMyGroups);
app.put("/addmembers", addMemberValidator(), validateHandler, addMembers);
app.put(
  "/removemember",
  removeMemberValidator(),
  validateHandler,
  removeMember
);
app.delete("/leave/:id", chatIdValidator(), validateHandler, leaveGroup);
// Send attachments
app.post(
  "/message",
  attachmentsMulter,
  sendAttachmentsValidator(),
  validateHandler,
  sendAttachments
);
// Get messages
app.get("/messages/:id", chatIdValidator(), validateHandler, getMessages);
// Get chat details,rename,delete
app
  .route("/:id")
  .get(chatIdValidator(), validateHandler, getChatDetails)
  .put(renameGroupValidator(), validateHandler, renameGroup)
  .delete(chatIdValidator(), validateHandler, deleteChat);
export default app;
