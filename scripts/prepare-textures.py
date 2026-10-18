"""Prepare local OpenStax teaching textures (CC BY 4.0); no image service."""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

root=Path(__file__).resolve().parents[1]
assets=root/'assets'

def clean_lines(img):
    a=np.array(img.convert('RGB'))
    dark=np.max(a,axis=2)<100
    # Printed black leader lines, unlike the organ pigments, are nearly neutral.
    neutral=np.max(a,axis=2)-np.min(a,axis=2)<22
    mask=Image.fromarray((dark&neutral).astype('uint8')*255).filter(ImageFilter.MaxFilter(3))
    repaired=img.copy()
    for size in [5,9,15]:
        median=repaired.filter(ImageFilter.MedianFilter(size))
        repaired=Image.composite(median,repaired,mask)
    return repaired

lung=Image.open(assets/'lungs-original.jpg').convert('RGB').crop((0,575,885,1220))
lung=clean_lines(lung)
# The display artwork clips this texture to the lungs, leaving the anatomical
# silhouette under project control. Low-opacity overlay retains source detail.
lung.resize((750,600),Image.Resampling.LANCZOS).save(assets/'lung-texture.webp',quality=90)

gut=Image.open(assets/'digestive-original.jpg').convert('RGB').crop((463,1215,1005,1760))
gut=clean_lines(gut)
arr=np.array(gut)
mask=((arr[:,:,2].astype(float)>arr[:,:,1]*.75)&(arr[:,:,0].astype(float)>arr[:,:,1]*1.13)).astype('uint8')*255
alpha=Image.fromarray(mask).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(1))
gut.putalpha(alpha)
gut.resize((600,600),Image.Resampling.LANCZOS).save(assets/'gut-texture.png')
print('Local teaching textures prepared.')
