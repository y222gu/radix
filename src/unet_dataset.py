"""PyTorch Datasets for U-Net segmentation training.

UNetSemanticDataset: 7-class semantic masks (bg + 6 anatomical regions).
UNetMultilabelDataset: 6-channel multilabel masks (all raw annotation classes at once).
UNetBinaryDataset: Per-class binary masks (one raw annotation class at a time).
"""

from typing import Callable, Dict, List, Optional

import albumentations as A
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

from .annotation_utils import (
    parse_yolo_annotations,
    polygons_to_raw_binary_masks,
    polygons_to_raw_semantic_mask,
)
from .config import SampleRecord
from .preprocessing import load_sample_normalized

class UNetSemanticDataset(Dataset):
    """Dataset for 7-class semantic segmentation (bg + 6 anatomical regions).

    Uses polygons_to_raw_semantic_mask() which paints from largest to smallest:
        0 = background
        1 = epidermis (whole root not covered by inner structures)
        2 = aerenchyma
        3 = endodermis ring (outer - inner via paint order)
        4 = vascular (inner endo area)
        5 = exodermis ring (outer - inner via paint order)
        6 = cortex (between inner exo and outer endo)

    Returns (H, W) int64 mask for cross-entropy loss.
    """

    NUM_CLASSES = 7

    def __init__(
        self,
        samples: List[SampleRecord],
        transform: Optional[A.Compose] = None,
        img_size: int = 1024,
    ):
        self.samples = samples
        self.transform = transform
        self.img_size = img_size

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        sample = self.samples[idx]

        img = load_sample_normalized(sample)
        h, w = img.shape[:2]

        anns = parse_yolo_annotations(sample.annotation_path, w, h)
        sem_mask = polygons_to_raw_semantic_mask(anns, h, w)

        img = cv2.resize(img, (self.img_size, self.img_size),
                         interpolation=cv2.INTER_LINEAR)
        sem_mask = cv2.resize(
            sem_mask.astype(np.uint8), (self.img_size, self.img_size),
            interpolation=cv2.INTER_NEAREST,
        ).astype(np.int32)

        if self.transform is not None:
            transformed = self.transform(image=img, mask=sem_mask)
            img = transformed["image"]
            sem_mask = transformed["mask"]

        img_tensor = torch.from_numpy(img.copy()).permute(2, 0, 1).float()
        mask_tensor = torch.from_numpy(sem_mask.copy()).long()

        return {"image": img_tensor, "mask": mask_tensor, "uid": sample.uid}

class UNetMultilabelDataset(Dataset):
    """Dataset for 6-channel multilabel segmentation.

    Returns all 6 raw annotation class masks stacked as (6, H, W) float32.
    Used by a single multilabel U-Net++ with sigmoid activation.

    Channels (raw annotation classes):
        0 = Whole Root
        1 = Aerenchyma
        2 = Outer Endodermis
        3 = Inner Endodermis
        4 = Outer Exodermis
        5 = Inner Exodermis

    Channels can overlap (e.g., outer endo contains inner endo area).
    """

    NUM_CLASSES = 6

    def __init__(
        self,
        samples: List[SampleRecord],
        transform: Optional[A.Compose] = None,
        img_size: int = 1024,
    ):
        self.samples = samples
        self.transform = transform
        self.img_size = img_size

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        sample = self.samples[idx]

        img = load_sample_normalized(sample)
        h, w = img.shape[:2]

        anns = parse_yolo_annotations(sample.annotation_path, w, h)
        binary_masks = polygons_to_raw_binary_masks(anns, h, w)

        mask_stack = np.stack([binary_masks[c] for c in range(6)])

        img = cv2.resize(img, (self.img_size, self.img_size),
                         interpolation=cv2.INTER_LINEAR)
        resized_masks = np.stack([
            cv2.resize(mask_stack[c], (self.img_size, self.img_size),
                       interpolation=cv2.INTER_NEAREST)
            for c in range(6)
        ])

        if self.transform is not None:

            additional_targets = {f"mask{i}": "mask" for i in range(1, 6)}
            aug = A.Compose(
                self.transform.transforms,
                additional_targets=additional_targets,
            )
            kwargs = {"image": img, "mask": resized_masks[0]}
            for i in range(1, 6):
                kwargs[f"mask{i}"] = resized_masks[i]
            transformed = aug(**kwargs)
            img = transformed["image"]
            resized_masks = np.stack([transformed["mask"]] +
                                     [transformed[f"mask{i}"] for i in range(1, 6)])

        img_tensor = torch.from_numpy(img.copy()).permute(2, 0, 1).float()
        mask_tensor = torch.from_numpy(resized_masks.copy()).float()

        return {"image": img_tensor, "mask": mask_tensor, "uid": sample.uid}
