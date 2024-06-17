import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { UploadStatus } from "@prisma/client";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { db } from "@/db";
 
const f = createUploadthing();
 
const auth = (req: Request) => ({ id: "fakeId" }); // Fake auth function
 

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {

      const {getUser} = getKindeServerSession()
      const user = await getUser()

      if(!user || !user.id){
        throw new Error("Unautohrized")
      }

      return {userId: user.id};
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`,
          uploadStatus: "PROCESSING",
        }
      })
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;