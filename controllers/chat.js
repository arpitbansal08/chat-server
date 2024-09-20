import {
  ALERT,
  NEW_ATTACHMENT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import {
  deleteFilesfromCloudinary,
  emmitEvent,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import ErrorHandler from "../utils/utility.js";

const newGroupChat = async (req, res, next) => {
  try {
    const { name, members } = req.body;
    const allMembers = [...members, req.user];
    await Chat.create({
      name,
      groupChat: true,
      creator: req.user,
      members: allMembers,
    });
    emmitEvent(req, ALERT, allMembers, {
      message: `Welcome to ${name} group chat`,
    });
    emmitEvent(req, REFETCH_CHATS, members, "Group chat created successfully");
    return res.status(201).json({
      success: true,
      message: "Group chat created successfully",
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const getMyChat = async (req, res, next) => {
  try {
    const chats = await Chat.find({ members: req.user }).populate(
      "members",
      "name username avatar"
    );

    const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
      const otherMember = getOtherMember(members, req.user);
      // console.log(name);
      // console.log("dad", otherMember);
      return {
        _id,
        name: groupChat ? name : otherMember?.name,
        groupChat,
        members: members.reduce((prev, curr) => {
          if (curr._id.toString() !== req.user.toString()) {
            prev.push(curr._id);
          }
          return prev;
        }, []),
        avatar: groupChat
          ? members.slice(0, 3).map(({ avatar }) => avatar?.url)
          : [otherMember?.avatar?.url],
      };
    });
    return res.status(200).json({
      success: true,
      chats: transformedChats,
    });
  } catch (err) {
    console.log("jjj");
    next(new ErrorHandler(err.message, 500));
  }
};

const getMyGroups = async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    creator: req.user,
    groupChat: true,
  }).populate("members", "name username avatar");
  const groups = chats.map(({ _id, name, members, groupChat }) => ({
    _id,
    name,
    groupChat,
    avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
  }));
  return res.status(200).json({
    success: true,
    chats: groups,
  });
};

const addMembers = async (req, res, next) => {
  try {
    const { chatId, members } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new ErrorHandler("Chat not found", 404));
    }
    if (!chat.groupChat) {
      return next(new ErrorHandler("This is not a group chat", 400));
    }
    if (chat.creator.toString() !== req.user.toString()) {
      return next(new ErrorHandler("You are not allowed to add members", 403));
    }
    const allNewMembers = members.map((member) => User.findById(member));
    const newMembers = await Promise.all(allNewMembers);

    const uniqueMembers = newMembers
      .filter((member) => !chat.members.includes(member._id.toString()))
      .map((member) => member._id);

    chat.members.push(...uniqueMembers);

    if (chat.length > 512) {
      return next(new ErrorHandler("Members limit reached", 400));
    }

    await chat.save();
    const allUsernames = newMembers.map((member) => member.name).join(",");
    emmitEvent(req, ALERT, chat.members, {
      chatId,
      message: `${allUsernames} added to ${chat.name} group chat`,
    });
    emmitEvent(req, REFETCH_CHATS, chat.members);
    return res.status(200).json({
      success: true,
      message: "Members added successfully",
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
const removeMember = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await Chat.findById(chatId);
    const usersThatwillBeRemoved = await User.findById(userId, "name");

    if (!chat) {
      return next(new ErrorHandler("Chat not found", 404));
    }
    if (!chat.groupChat) {
      return next(new ErrorHandler("This is not a group chat", 400));
    }
    if (chat.creator.toString() !== req.user.toString()) {
      return next(
        new ErrorHandler("You are not allowed to remove members", 403)
      );
    }
    if (chat.members.length <= 2) {
      return next(
        new ErrorHandler("Group chat should have atleast 2 members", 400)
      );
    }
    const allChatMembers = chat.members.map((member) => member.toString());
    chat.members = chat.members.filter(
      (member) => member.toString() !== userId.toString()
    );
    await chat.save();
    emmitEvent(req, ALERT, chat.members, {
      chatId,
      message: `${usersThatwillBeRemoved.name} removed from ${chat.name} group chat`,
    });
    emmitEvent(req, REFETCH_CHATS, allChatMembers);
    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const leaveGroup = async (req, res, next) => {
  const chatId = req.params.id;
  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new ErrorHandler("Chat not found", 404));
  }
  if (!chat.groupChat) {
    return next(new ErrorHandler("This is not a group chat", 400));
  }
  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.user.toString()
  );
  if (remainingMembers.length < 2) {
    return next(
      new ErrorHandler("Group chat should have atleast 2 members", 400)
    );
  }
  if (chat.creator.toString() === req.user.toString()) {
    const newCreator = remainingMembers[0];
    chat.creator = newCreator;
  }

  chat.members = remainingMembers;
  const user = await User.findById(req.user, "name");
  await chat.save();
  emmitEvent(req, ALERT, chat.members, {
    chatId,
    message: `${user.name} has left the ${chat.name} group chat`,
  });
  emmitEvent(req, REFETCH_CHATS, chat.members);
  return res.status(200).json({
    success: true,
    message: "User left the group chat",
  });
};

const sendAttachments = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new ErrorHandler("Chat not found", 404));
    }
    const me = await User.findById(req.user, "name");
    const files = req.files || [];

    if (files.length < 1) {
      return next(new ErrorHandler("Please provide attachments", 400));
    }
    if (files.length > 5) {
      return next(
        new ErrorHandler("You can upload maximum 5 files at a time", 400)
      );
    }
    // Upload files here on cloudinary
    const attachments = await uploadFilesToCloudinary(files);
    const messageForDB = {
      content: "",
      attachments: attachments,
      sender: me._id,
      chat: chatId,
    };
    const messageForRealTime = {
      ...messageForDB,
      sender: {
        _id: me._id,
        name: me.name,
      },
    };
    const message = await Message.create(messageForDB);

    emmitEvent(req, NEW_MESSAGE, chat.members, {
      message: messageForRealTime,
      chatId,
    });
    emmitEvent(req, NEW_MESSAGE_ALERT, chat.members, chatId);

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (err) {
    next(new ErrorHandler(err, 500));
  }
};

const getChatDetails = async (req, res, next) => {
  try {
    if (req.query.populate === "true") {
      const chat = await Chat.findById(req.params.id)
        .populate("members", "name avatar")
        .lean();
      if (!chat) {
        return next(new ErrorHandler("Chat not found", 404));
      }
      chat.members = chat.members.map(({ _id, name, avatar }) => ({
        _id,
        name,
        avatar: avatar.url,
      }));
      return res.status(200).json({
        success: true,
        chat,
      });
    } else {
      const chat = await Chat.findById(req.params.id);
      if (!chat) {
        return next(new ErrorHandler("Chat not found", 404));
      }
      return res.status(200).json({
        success: true,
        chat,
      });
    }
  } catch (err) {
    next(new ErrorHandler(err, 500));
  }
};

const renameGroup = async (req, res, next) => {
  try {
    const chatId = req.params.id;
    const { name } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new ErrorHandler("Chat not found", 404));
    }
    if (!chat.groupChat) {
      return next(new ErrorHandler("This is not a group chat", 400));
    }
    if (chat.creator.toString() !== req.user.toString()) {
      return next(
        new ErrorHandler("You are not allowed to rename the group", 403)
      );
    }
    chat.name = name;
    await chat.save();
    emmitEvent(req, REFETCH_CHATS, chat.members);
    return res.status(200).json({
      success: true,
      message: "Group chat renamed successfully",
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const deleteChat = async (req, res, next) => {
  try {
    const chatId = req.params.id;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new ErrorHandler("Chat not found", 404));
    }
    if (chat.groupChat && chat.creator.toString() !== req.user.toString()) {
      return next(
        new ErrorHandler("You are not allowed to delete the group", 403)
      );
    }
    if (!chat.groupChat && !chat.members.includes(req.user)) {
      return next(
        new ErrorHandler("You are not allowed to delete the chat", 403)
      );
    }
    // Here we have to delete all the messages,attachments from cloudinary as well of this chat
    const messagesWithAttachments = await Message.find({
      chat: chatId,
      attachments: { $exists: true, $ne: [] },
    });
    const public_ids = [];
    messagesWithAttachments.forEach(({ attachments }) => {
      attachments.forEach(({ public_id }) => {
        public_ids.push(public_id);
      });
    });
    await Promise.all([
      // Delete files from cloudinary
      deleteFilesfromCloudinary(public_ids),
      chat.deleteOne(),
      Message.deleteMany({ chat: chatId }),
    ]);
    emmitEvent(req, REFETCH_CHATS, chat.members);
    return res.status(200).json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const getMessages = async (req, res, next) => {
  try {
    const chatId = req.params.id;
    const { page = 1 } = req.query;
    const limit = 20; // messages per page

    const skip = (page - 1) * limit;
    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!chat.members.includes(req.user.toString()))
      return next(
        new ErrorHandler("You are not allowed to access this chat", 403)
      );
    const [messages, totalMessagesCount] = await Promise.all([
      Message.find({ chat: chatId })
        .populate("sender", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ chat: chatId }),
    ]);
    const totalPages = Math.ceil(totalMessagesCount / limit) || 0;
    return res.status(200).json({
      success: true,
      messages: messages.reverse(),
      totalPages,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

export {
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
};
