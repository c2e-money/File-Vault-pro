import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req:any,res:any){

  if(req.method !== "POST"){
    return res.status(405).json({
      error:"Method not allowed"
    });
  }


  const uploadDir = "/tmp/uploads";

  if(!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir,{recursive:true});
  }


  const form = new IncomingForm({
    uploadDir,
    keepExtensions:true,
    multiples:true,
    maxFileSize:1024*1024*1000
  });


  form.parse(req,(err,fields,files)=>{

    if(err){
      return res.status(500).json({
        error:err.message
      });
    }


    console.log(files);


    return res.status(201).json({
      message:"Files uploaded successfully",
      files
    });

  });

}
