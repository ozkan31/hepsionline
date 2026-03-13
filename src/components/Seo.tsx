import { useEffect } from "react";
import { applySeo, type SeoPayload } from "@/lib/seo";

export function Seo(props: SeoPayload) {
  const schemaKey = props.schema ? JSON.stringify(props.schema) : "";

  useEffect(() => {
    applySeo(props);
  }, [
    props.title,
    props.description,
    props.canonicalPath,
    props.canonicalUrl,
    props.image,
    props.type,
    props.noindex,
    schemaKey,
  ]);

  return null;
}
