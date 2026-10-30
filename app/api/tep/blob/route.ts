import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getUser } from "@/lib/auth";
import { canAccessObject } from "@/lib/files";

/** Cấp quyền tải tệp trực tiếp lên Vercel Blob (tối đa 20 MB) */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getUser();
        if (!user) throw new Error("Chưa đăng nhập");
        const p = JSON.parse(clientPayload || "{}");
        if (!(await canAccessObject(user, String(p.doiTuong), Number(p.idDoiTuong), true))) throw new Error("Không có quyền");
        return {
          allowedContentTypes: [
            "image/*",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 400 });
  }
}
