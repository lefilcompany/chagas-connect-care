import { useParams } from "react-router-dom";
import { JourneyBuilder } from "@/features/journeys/JourneyBuilder";

export default function JourneyEditor() {
  const { id } = useParams<{ id: string }>();
  return <JourneyBuilder id={id ?? ""} />;
}