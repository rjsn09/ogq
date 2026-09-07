/*
GeneratedGrid.tsx integration example

IMPORTANT:
- This is not a replacement for your current GeneratedGrid.tsx.
- Add the imports/state/hook below to the component that currently owns
  the "선택 n장 생성하기" button and the reference image/description.
*/

import { CanonicalConfirmPanel } from "./CanonicalConfirmPanel";
import { useCanonicalGeneration } from "../hooks/useCanonicalGeneration";

// Example existing values:
// const referenceImage: File | null = ...
// const characterBase: string = ...
// const selectedIndices: number[] = ...
// const variantNames: Record<number, string> = ...
// const [jobId, setJobId] = useState<string | null>(null);

const canonicalFlow = useCanonicalGeneration({
  image: referenceImage,
  characterBase,
  ipScale: 0.60,
  canonicalSteps: 30,

  // Put your CURRENT job-id handling here.
  // If your existing code starts polling after setJobId(), this is enough.
  onStickerJobStarted: (newJobId) => {
    setJobId(newJobId);
  },
});

// Replace the old generate button handler:
//
// OLD:
// const newJobId = await createGenerateSet(...)
//
// NEW:
async function handleGenerateSelected() {
  await canonicalFlow.requestGeneration({
    indices: selectedIndices,
    variantNames,
    candidateCount: 2,
    img2imgStrength: 0.68,
    controlnetScale: 0.90,
    steps: 30,
  });
}

// Somewhere near the end of the component JSX:
<CanonicalConfirmPanel {...canonicalFlow.panelProps} />

// Resulting UX:
//
// "선택 n장 생성하기"
//       ↓
// canonical does not exist
//       ↓
// create canonical
//       ↓
// confirmation panel automatically opens
//       ↓
// [다시 생성] --------┐
//       ↑             │
//       └-------------┘
//       ↓
// [이 캐릭터로 만들기]
//       ↓
// approve
//       ↓
// same pending selected slots are generated automatically
//
// After approval, later partial-regeneration requests reuse the same
// approved canonical until referenceImage or characterBase changes.
*/

export {};
