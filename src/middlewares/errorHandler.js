import Joi from "joi";

const errorHandler = (error, req, res, next) => {
  console.error("Unhandled error:", error);

  let status = 500;
  let data = {
    message: "Internal Server Error",
  };

  if (error instanceof Joi.ValidationError) {
    status = 400;
    data.message = error.message;
    console.error("Joi Validation Error:", error.details);
    return res.status(status).json(data);
  }

  if (error.status) {
    status = error.status;
  }
  if (error.message) {
    data.message = error.message;
  }

  return res.status(status).json(data);
};

export default errorHandler;
