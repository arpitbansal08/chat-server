import { faker, simpleFaker } from "@faker-js/faker";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
const createSingleChats = async (numChats) => {
  try {
    const users = await User.find().select("_id");
    const chatPromise = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        chatPromise.push(
          Chat.create({
            name: faker.lorem.words(2),
            members: [users[i], users[j]],
          })
        );
      }
    }
    await Promise.all(chatPromise);
    console.log("chats created");
    process.exit(1);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
const createGroupChats = async (numChats) => {
  try {
    const users = await User.find().select("_id");
    const chatPromise = [];
    for (let i = 0; i < numChats; i++) {
      const numMembers = simpleFaker.number.int({ min: 3, max: users.length });
      const members = [];
      for (let j = 0; j < numMembers; j++) {
        const rndmIndex = Math.floor(Math.random() * users.length);
        const rndmUser = users[rndmIndex];
        if (!members.includes(rndmUser)) {
          members.push(rndmUser);
        }
      }
      const chat = await Chat.create({
        groupChat: true,
        name: faker.lorem.words(1),
        members,
        creator: members[0],
      });
      chatPromise.push(chat);
    }
    await Promise.all(chatPromise);
    console.log("group chats created");
    process.exit(1);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

const createMessage = async (numMessages) => {
  try {
    const users = await User.find().select("_id");
    const chats = await Chat.find().select("_id");
    const messagesPromise = [];
    for (let i = 0; i < numMessages; i++) {
      const rndmUser = users[Math.floor(Math.random() * users.length)];
      const rndmChat = chats[Math.floor(Math.random() * chats.length)];
      // we are not checking if rndmUser is a member of rndmChat or not
      messagesPromise.push(
        Message.create({
          sender: rndmUser,
          chat: rndmChat,
          content: faker.lorem.sentence(10),
        })
      );
    }
    await Promise.all(messagesPromise);
    console.log("messages created");
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
const createMessageInaChat = async (numMessages, chatId) => {
  try {
    const users = await User.find().select("_id");
    const messagesPromise = [];
    for (let i = 0; i < numMessages; i++) {
      const rndmUser = users[Math.floor(Math.random() * users.length)];
      messagesPromise.push(
        Message.create({
          sender: rndmUser,
          chat: chatId,
          content: faker.lorem.sentence(10),
        })
      );
    }
    await Promise.all(messagesPromise);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
export {
  createGroupChats,
  createMessage,
  createMessageInaChat,
  createSingleChats,
};
