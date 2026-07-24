# Vidéos publiques (page /tutoriels)

Fichiers attendus par `app/tutoriels/page.tsx` :

| Fichier | Source Screen Studio | Rôle |
|---|---|---|
| `pre-inscription-ordinateur.mp4` | `~/Desktop/ScreenStudio/demo-pre-inscription-ordi.screenstudio` | Vidéo 1 — inscription depuis un ordinateur (~1 min 15) |
| `pre-inscription-ordinateur.jpg` | export d'une image du même projet | Poster + vignette de l'email |
| `pre-inscription-mobile.mp4` | `~/Desktop/ScreenStudio/demo-pre-inscription.responsive.screenstudio` | Vidéo 2 — inscription depuis un téléphone (~1 min 30) |
| `pre-inscription-mobile.jpg` | export d'une image du même projet | Poster + vignette de l'email |

## Export depuis Screen Studio

Ouvrir le projet → `Export` (⌘E) → **MP4**, 1280×720 ou 1920×1080, 30 fps,
qualité "Web/Optimized". Viser **≤ 12 Mo par vidéo** : au-delà, la lecture
démarre lentement sur mobile et le dépôt alourdit le repo.

Le poster peut être exporté depuis Screen Studio (`Export Frame`) ou extrait
du MP4 :

    ffmpeg -i pre-inscription-ordinateur.mp4 -ss 00:00:01 -vframes 1 -q:v 3 \
           pre-inscription-ordinateur.jpg

Recompression si le fichier dépasse la cible :

    ffmpeg -i entree.mp4 -vcodec libx264 -crf 26 -preset slow -vf scale=1280:-2 \
           -acodec aac -b:a 96k sortie.mp4

Les projets `.screenstudio` ne sont PAS des vidéos : ils contiennent la
capture brute en fragments `.m4s` plus les effets (zooms, curseur, fond,
mockup) que seul Screen Studio sait rendre. L'export est donc manuel.
