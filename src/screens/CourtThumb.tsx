import type { CourtObject, CourtType } from "../types/play";
import { CourtCanvas } from "./CourtCanvas";

type Props = {
  court: CourtType;
  objects: CourtObject[];
};

export function CourtThumb({ court, objects }: Props) {
  return (
    <div className="pointer-events-none h-full w-full overflow-hidden">
      <CourtCanvas
        court={court}
        objects={objects}
        interactive={false}
        onMove={() => {}}
        onSelectPlayer={() => {}}
      />
    </div>
  );
}
