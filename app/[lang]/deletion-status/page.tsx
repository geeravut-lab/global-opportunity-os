import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { DeletionReceipt } from "@/components/deletion-receipt";
export default async function Status({ params }: { params: Promise<{ lang: string }> }) { const { lang } = await params; if (!isLocale(lang)) notFound(); return <DeletionReceipt lang={lang} />; }
