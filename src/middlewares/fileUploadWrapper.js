import fileUpload from "express-fileupload";

const fileUploadWrapper = (methods) => {
  return (req, res, next) => {
    if (methods.includes(req.method)) {
      fileUpload({
        useTempFiles: false,
        limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB file size limit
        debug: true,
      })(req, res, next);
    } else {
      next(); // Skip fileUpload middleware for other methods
    }
  };
};

export default fileUploadWrapper; 
