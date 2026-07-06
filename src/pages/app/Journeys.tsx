import { JourneyList } from "@/features/journeys/JourneyList";
import { PreviewBanner } from "@/features/journeys/PreviewBanner";

export default function Journeys() {
  return (
    <div className="space-y-6">
      <PreviewBanner />
      <JourneyList />
    </div>
  );
}