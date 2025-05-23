import { s3Client } from "./s3-credentials.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const putObject = async (file, fileName) => {
    try {
        if (!file || !file.data) {
            throw new Error("File data is missing or empty");
        }
        console.log("bucket",process.env.AWS_S3_BUCKET);

        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: file.data, // Directly use the file buffer
            ContentType: file.mimetype || "application/octet-stream", // Ensure ContentType is valid
        };

        console.log("Uploading file with params:", params);

        const command = new PutObjectCommand(params);
        const data = await s3Client.send(command);

        if (data.$metadata.httpStatusCode !== 200) {
            throw new Error("Failed to upload file to S3");
        }

        const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
        // console.log("Uploaded file URL:", url);

        return { url, key: params.Key };
    } catch (err) {
        console.error("Error uploading file to S3:", err);
        throw err;
    }
};
