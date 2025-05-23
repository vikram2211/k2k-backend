import { s3Client } from "./s3-credentials.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";




export const getObject = async(key) =>{
    try{
        const params = {
            Bucket:process.env.AWS_S3_BUCKET,
            Key:key
        }
        const command = new GetObjectCommand(params);
        const data = await s3Client.send(command);
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); 
        console.log(data);
        return url;
        
    }catch(err){
        console.error(err);
    }
}