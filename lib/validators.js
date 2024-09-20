import { body, check, param, validationResult } from "express-validator";
import ErrorHandler from "../utils/utility.js";

const validateHandler = (req, res, next) => {
  const errors = validationResult(req);
  const errorMessags = errors
    .array()
    .map((error) => error.msg)
    .join(", ");
  console.log(errorMessags);
  if (errors.isEmpty()) {
    return next();
  } else {
    return next(new ErrorHandler(errorMessags, 400));
  }
};

const registerValidator = () => [
  body("name", "Please enter Name").notEmpty(),
  body("username", "Please enter Username").notEmpty(),
  body("password", "Please enter Password").notEmpty(),
  body("bio", "Please enter Bio").notEmpty(),
];

const loginValidator = () => [
  body("username", "Please enter Username").notEmpty(),
  body("password", "Please enter Password").notEmpty(),
];

const newGroupChatValidator = () => [
  body("name", "Please enter Name").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please enter members")
    .isArray({ min: 2, max: 100 })
    .withMessage("Members should be an array with minimum 2 members"),
];
const addMemberValidator = () => [
  body("chatId", "Please enter chatId").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please enter members")
    .isArray({ min: 1, max: 100 })
    .withMessage("Members should be an array with minimum 1 member"),
];
const removeMemberValidator = () => [
  body("chatId", "Please enter chatId").notEmpty(),
  body("userId", "Please enter userId").notEmpty(),
];

const sendAttachmentsValidator = () => [
  body("chatId", "Please enter chatId").notEmpty(),
];

const chatIdValidator = () => [param("id", "Please enter chatId").notEmpty()];

const renameGroupValidator = () => [
  param("id", "Please enter chatId").notEmpty(),
  body("name", "Please enter new Name").notEmpty(),
];
const sendRequestValidator = () => [
  body("userId", "Please enter friends userId").notEmpty(),
];
const acceptRequestValidator = () => [
  body("requestId", "Please enter requestId").notEmpty(),
  body("accept")
    .notEmpty()
    .withMessage("Please enter accept")
    .isBoolean()
    .withMessage("Accept should be a boolean"),
];

const adminLoginValidator = () => [
  body("secretKey", "Please enter secretKey").notEmpty(),
];
export {
  acceptRequestValidator,
  addMemberValidator,
  adminLoginValidator,
  chatIdValidator,
  loginValidator,
  newGroupChatValidator,
  registerValidator,
  removeMemberValidator,
  renameGroupValidator,
  sendAttachmentsValidator,
  sendRequestValidator,
  validateHandler,
};
