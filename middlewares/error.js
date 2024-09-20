// this is wrapper function to handle all errors in the application and print {success: false, message: "error message"} in the response

const errorMiddleware = (err, req, res, next) => {
  err.message ||= "Internal Server Error";
  err.statusCode ||= 400;
  if (err.message.code === 11000) {
    const duplicateValue = Object.keys(err.message.keyPattern).join(",");
    err.message = `Duplicate Field Value Entered ,Please enter another value for ${duplicateValue}`;
    err.statusCode = 400;
  }
  if (err.message.name === "CastError") {
    const message = `Invalid format of ${err.message.path}`;
    err.message = message;
    err.statusCode = 400;
  }
  const response = {
    success: false,
    message: err.message,
  };
  if (process.env.NODE_ENV === "DEVELOPMENT") {
    response.error = err;
  }
  return res.status(err.statusCode).json(response);
};

export { errorMiddleware };
