import { createFileRoute } from "@tanstack/react-router";
import { FlashGame } from "@/components/flash/FlashGame";

const title = "KruMath Flash — Mental Math Flash Game";
const description =
  "Flash numbers, calculate in your head, answer fast. A minimal mental arithmetic game for students, classrooms and projectors.";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: FlashGame,
});
