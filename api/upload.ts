import { IncomingForm } from "formidable";
import fs from "fs";

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


  const form = new IncomingForm({
    uploadDir:"/tmp",
    keepExtensions:true
  });


  form.parse(req,(err,fields,files)=>{

    if(err){
      return res.status(500).json({
        error:err.message
      });
    }


    const file:any = files.file;


    if(!file){
      return res.status(400).json({
        error:"No file found"
      });
    }


    return res.status(200).json({
      success:true,
      message:"Upload successful",
      filename:file.originalFilename
    });

  });

  }
