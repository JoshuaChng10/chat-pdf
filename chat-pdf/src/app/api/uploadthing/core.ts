import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { db } from "@/db";
import {PDFLoader} from "@langchain/community/document_loaders/fs/pdf"
import { pinecone } from "@/lib/pinecone";
import { OpenAIEmbeddings } from '@langchain/openai'
import {PineconeStore} from "@langchain/pinecone"
 
const f = createUploadthing();
 
const auth = (req: Request) => ({ id: "fakeId" }); // Fake auth function
 

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async () => {

      const {getUser} = getKindeServerSession()
      const user = await getUser()

      if(!user || !user.id){
        throw new Error("Unauthorized")
      }

      return {userId: user.id};
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.url,
          uploadStatus: 'PROCESSING',
        },
      })

      //index with vector database
      try {
        console.log("Fetching file from URL:", file.url);
        const response = await fetch(file.url);
        const blob = await response.blob();
        console.log("File fetched successfully");
    
        console.log("Loading PDF with PDFLoader");
        const loader = new PDFLoader(blob);
        const pageLevelDocs = await loader.load();
        console.log("PDF loaded, number of pages:", pageLevelDocs.length);
    
        // vectorize and index entire document
        const pineconeIndex = pinecone.index("chatpdf");
    
        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY
        });
    
        console.log("Creating PineconeStore from documents");
        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
          namespace: createdFile.id,
        });
        console.log("Pinecone all good");
        await db.file.update({
          data: {
            uploadStatus: "SUCCESS"
          },
          where: {
            id: createdFile.id
          }
        });
        console.log("File indexed successfully");
    
      } catch (err) {
        console.error("Error during vectorization and indexing:", err);
        await db.file.update({
          data: {
            uploadStatus: "FAILED"
          },
          where: {
            id: createdFile.id
          }
        });
      }
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;