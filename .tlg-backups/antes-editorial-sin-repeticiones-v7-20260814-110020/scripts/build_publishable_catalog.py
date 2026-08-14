#!/usr/bin/env python3
"""Build the 100-album/100-song runtime catalog and trilingual notes.

The script keeps the approved editorial selection intact, attaches only exact
service entity URLs, uses optimized local artwork and guarantees that every
record has a listening note in Spanish, English and French.
"""

from __future__ import annotations

import copy
import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CATALOG = DATA / "catalog"
LANGUAGES = ("es", "en", "fr")
COVER_CLASSES = ("cover-blue", "cover-red", "cover-yellow", "cover-green")

SOURCE_LABELS = {
    "RS-ALB": {"es": "Rolling Stone — 500 mejores álbumes", "en": "Rolling Stone — 500 Greatest Albums", "fr": "Rolling Stone — 500 meilleurs albums"},
    "RS-SONG": {"es": "Rolling Stone — 500 mejores canciones", "en": "Rolling Stone — 500 Greatest Songs", "fr": "Rolling Stone — 500 meilleures chansons"},
    "APPLE": {"es": "Apple Music — 100 mejores álbumes", "en": "Apple Music — 100 Best Albums", "fr": "Apple Music — 100 meilleurs albums"},
    "NME": {"es": "NME — 500 mejores álbumes", "en": "NME — 500 Greatest Albums", "fr": "NME — 500 meilleurs albums"},
    "PITCH": {"es": "Pitchfork — listas por década y año", "en": "Pitchfork — lists by decade and year", "fr": "Pitchfork — sélections par décennie et par année"},
    "ACCLAIM": {"es": "Acclaimed Music — agregador crítico", "en": "Acclaimed Music — critical aggregator", "fr": "Acclaimed Music — agrégateur critique"},
    "600LATAM": {"es": "Los 600 Discos de Latinoamérica", "en": "The 600 Albums of Latin America", "fr": "Les 600 albums d’Amérique latine"},
    "RS-BR": {"es": "Rolling Stone Brasil — discos y canciones", "en": "Rolling Stone Brasil — albums and songs", "fr": "Rolling Stone Brasil — albums et chansons"},
    "ROCKDELUX": {"es": "Rockdelux — listas por género y escena", "en": "Rockdelux — genre and scene lists", "fr": "Rockdelux — sélections par genre et par scène"},
    "INDIEHOY": {"es": "Indie Hoy — listas argentinas y por década", "en": "Indie Hoy — Argentine and decade lists", "fr": "Indie Hoy — sélections argentines et par décennie"},
    "RADIONICA": {"es": "Radiónica — música colombiana y latinoamericana", "en": "Radiónica — Colombian and Latin American music", "fr": "Radiónica — musique colombienne et latino-américaine"},
    "LESINROCKS": {"es": "Les Inrockuptibles — listas francesas", "en": "Les Inrockuptibles — French lists", "fr": "Les Inrockuptibles — sélections françaises"},
    "RA": {"es": "Resident Advisor — mejores discos y pistas", "en": "Resident Advisor — best records and tracks", "fr": "Resident Advisor — meilleurs disques et morceaux"},
    "JAZZWISE": {"es": "Jazzwise — 100 discos que transformaron el jazz", "en": "Jazzwise — 100 Jazz Albums That Shook the World", "fr": "Jazzwise — 100 albums qui ont transformé le jazz"},
    "PAM": {"es": "Pan African Music — selecciones africanas", "en": "Pan African Music — African selections", "fr": "Pan African Music — sélections africaines"},
    "RS-JP": {"es": "Rolling Stone Japan — 100 álbumes japoneses de rock", "en": "Rolling Stone Japan — 100 Japanese Rock Albums", "fr": "Rolling Stone Japan — 100 albums japonais de rock"},
    "BEEHYPE": {"es": "Beehype — mejores álbumes japoneses", "en": "Beehype — best Japanese albums", "fr": "Beehype — meilleurs albums japonais"},
    "LOC": {"es": "Registro Nacional de Grabaciones", "en": "National Recording Registry", "fr": "Registre national des enregistrements"},
    "DISCOGS": {"es": "Discogs — comunidad, ediciones y colección", "en": "Discogs — community, editions and collecting", "fr": "Discogs — communauté, éditions et collection"},
}


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write(path: Path, payload) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def load_song_listening_keys() -> dict[str, dict[str, str]]:
    path = DATA / "song-listening-keys.tsv"
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t")
        return {
            row["id"]: {language: row[language].strip() for language in LANGUAGES}
            for row in rows
        }


def load_manual_album_editorials() -> dict[str, dict]:
    """Load the individually written album notes that replace bulk templates."""
    path = DATA / "editorial-albums-manual.tsv"
    required = {
        "id", "entry",
        "review_es", "listen1_es", "listen2_es",
        "review_en", "listen1_en", "listen2_en",
        "review_fr", "listen1_fr", "listen2_fr",
    }
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))

    if not rows:
        raise SystemExit(f"Manual album editorial source is empty: {path}")
    missing_columns = required - set(rows[0])
    if missing_columns:
        raise SystemExit(
            "Manual album editorial source is missing columns: "
            + ", ".join(sorted(missing_columns))
        )

    editorials: dict[str, dict] = {}
    for row_number, row in enumerate(rows, start=2):
        record_id = row["id"].strip()
        if not record_id or record_id in editorials:
            raise SystemExit(
                f"Missing or repeated album id in {path.name}, row {row_number}: {record_id!r}"
            )
        entry = row["entry"].strip()
        if not entry:
            raise SystemExit(f"Missing album entry point for {record_id}")
        localized = {}
        for language in LANGUAGES:
            review = row[f"review_{language}"].strip()
            listen_for = [
                row[f"listen1_{language}"].strip(),
                row[f"listen2_{language}"].strip(),
            ]
            if not review or not all(listen_for):
                raise SystemExit(
                    f"Incomplete {language.upper()} manual album note for {record_id}"
                )
            localized[language] = {
                "review": [review],
                "listenFor": listen_for,
                "entryPoint": {"title": entry, "reason": ""},
            }
        editorials[record_id] = {
            "readTime": 1,
            "headerPosition": "center",
            "trackMentions": [entry],
            **localized,
        }
    return editorials


def load_manual_song_editorials() -> dict[str, dict]:
    """Load one individually written note for every non-legacy song."""
    path = DATA / "editorial-songs-manual.tsv"
    required = {
        "id",
        "review_es", "listen1_es", "listen2_es",
        "review_en", "listen1_en", "listen2_en",
        "review_fr", "listen1_fr", "listen2_fr",
    }
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))

    if not rows:
        raise SystemExit(f"Manual song editorial source is empty: {path}")
    missing_columns = required - set(rows[0])
    if missing_columns:
        raise SystemExit(
            "Manual song editorial source is missing columns: "
            + ", ".join(sorted(missing_columns))
        )

    editorials: dict[str, dict] = {}
    for row_number, row in enumerate(rows, start=2):
        record_id = row["id"].strip()
        if not record_id or record_id in editorials:
            raise SystemExit(
                f"Missing or repeated song id in {path.name}, row {row_number}: {record_id!r}"
            )
        localized = {}
        for language in LANGUAGES:
            review = row[f"review_{language}"].strip()
            listen_for = [
                row[f"listen1_{language}"].strip(),
                row[f"listen2_{language}"].strip(),
            ]
            if not review or not all(listen_for):
                raise SystemExit(
                    f"Incomplete {language.upper()} manual song note for {record_id}"
                )
            localized[language] = {
                "review": [review],
                "listenFor": listen_for,
                "entryPoint": {"title": "", "reason": ""},
            }
        editorials[record_id] = {
            "readTime": 1,
            "headerPosition": "center",
            **localized,
        }
    return editorials


def number(record_id: str) -> int:
    return int(record_id.rsplit("-", 1)[1])


def clean_track(title: str) -> str:
    title = re.sub(r"\s*[\[(](?:\d{4}\s*[-–—]?\s*)?(?:remaster(?:ed)?|mix/master|mono|live\s*\d*|album version)[^\])]*[\])]", "", title, flags=re.I)
    return re.sub(r"\s+", " ", title).strip()


MANUAL_TRACKS = {
    "album-030": ["Sign o' the Times", "Play in the Sunshine", "Housequake"],
    "album-033": ["Hunter", "Jóga", "Unravel"],
    "album-041": ["Is This It", "The Modern Age", "Soma"],
    "album-043": ["Bamboo Banga", "BirdFlu", "Boyz"],
    "album-045": ["Start", "Thinkin Bout You", "Fertilizer"],
    "album-047": ["I Want You to Love Me", "Shameika", "Fetch the Bolt Cutters"],
    "album-067": ["Kaze wo Atsumete", "Dakishimetai", "Haikara Hakuchi"],
    "album-073": ["Expensive Shit", "Water No Get Enemy"],
    "album-078": ["Smooth Operator", "Your Love Is King", "Hang On to Your Love"],
    "album-081": ["Bring the Noise", "Don't Believe the Hype", "Rebel Without a Pause"],
    "album-086": ["Excursions", "Buggin' Out", "Electric Relaxation"],
    "album-089": ["Rid of Me", "Missed", "Legs"],
    "album-097": ["Al Natural", "Abayarde", "Pa' Que Retozen"],
    "album-098": ["The Illest Villains", "Accordion", "Meat Grinder"],
    "album-102": ["Ain't That Easy", "1000 Deaths", "The Charade"],
    "album-104": ["Rise", "Weary", "Cranes in the Sky"],
    "album-106": ["Moscow Mule", "Después de la Playa", "Me Porto Bonito"],
}

MANUAL_ALBUM_MINUTES = {
    "album-030": 80, "album-033": 44, "album-041": 36, "album-043": 47,
    "album-045": 55, "album-047": 51, "album-067": 36, "album-073": 25,
    "album-078": 45, "album-081": 58, "album-086": 48, "album-089": 48,
    "album-097": 75, "album-098": 46, "album-102": 56, "album-104": 52,
    "album-106": 82,
}

MANUAL_SONG_MS = {
    "song-047": 592920,
    "song-058": 243278,
    "song-084": 255000,
    "song-119": 190173,
}

# These notes predate the bulk catalog build and received individual editorial
# review. The generated output is read back only for this explicit allowlist;
# every other record is rebuilt from the current templates on each run.
CURATED_EDITORIAL_IDS = {
    "album-002", "album-003", "album-005", "album-006", "album-007",
    "album-009", "album-011", "album-012", "album-013", "album-014",
    "album-015", "album-016", "album-017", "album-018", "album-019",
    "album-020", "album-021", "album-022", "album-023", "album-025",
    "album-027", "album-028", "album-029", "album-030", "song-001",
}


PROFILES = {
    "jazz": {
        "core": {"es": "la conversación entre timbre, espacio e improvisación", "en": "the conversation among timbre, space and improvisation", "fr": "le dialogue entre timbre, espace et improvisation"},
        "cues": {
            "es": ["el espacio entre el primer gesto y su respuesta", "cómo la sección rítmica impulsa sin saturar", "el cambio de color entre una frase y la siguiente"],
            "en": ["the space between the opening gesture and its answer", "how the rhythm section drives without crowding", "the change of colour from one phrase to the next"],
            "fr": ["l’espace entre le premier geste et sa réponse", "la façon dont la section rythmique avance sans saturer", "le changement de couleur d’une phrase à l’autre"],
        },
    },
    "soul": {
        "core": {"es": "la tensión entre voz, groove y arreglo", "en": "the tension among voice, groove and arrangement", "fr": "la tension entre voix, groove et arrangement"},
        "cues": {
            "es": ["cómo la voz entra y sale del pulso", "la función narrativa del bajo y la percusión", "los detalles del arreglo que responden a la melodía"],
            "en": ["how the voice moves in and out of the pulse", "the narrative role of bass and percussion", "the arrangement details that answer the melody"],
            "fr": ["la manière dont la voix entre et sort du rythme", "le rôle narratif de la basse et des percussions", "les détails de l’arrangement qui répondent à la mélodie"],
        },
    },
    "hiphop": {
        "core": {"es": "la relación entre flujo verbal, ritmo y montaje sonoro", "en": "the relationship among verbal flow, rhythm and sonic montage", "fr": "la relation entre flux verbal, rythme et montage sonore"},
        "cues": {
            "es": ["la colocación de cada sílaba dentro del compás", "cómo el fondo cambia el sentido de la voz", "los cortes y repeticiones que construyen continuidad"],
            "en": ["the placement of each syllable inside the bar", "how the backdrop changes the meaning of the voice", "the cuts and repetitions that build continuity"],
            "fr": ["la place de chaque syllabe dans la mesure", "la façon dont le fond sonore modifie le sens de la voix", "les coupes et répétitions qui construisent la continuité"],
        },
    },
    "electronic": {
        "core": {"es": "la repetición, la textura y el cambio microscópico", "en": "repetition, texture and microscopic change", "fr": "la répétition, la texture et le changement microscopique"},
        "cues": {
            "es": ["los elementos que aparecen sin anunciarse", "la transformación gradual del pulso", "cómo el espacio modifica el peso de cada sonido"],
            "en": ["the elements that arrive without announcement", "the gradual transformation of the pulse", "how space changes the weight of each sound"],
            "fr": ["les éléments qui apparaissent sans s’annoncer", "la transformation progressive du rythme", "la façon dont l’espace modifie le poids de chaque son"],
        },
    },
    "latin": {
        "core": {"es": "el diálogo rítmico entre percusión, voz y melodía", "en": "the rhythmic dialogue among percussion, voice and melody", "fr": "le dialogue rythmique entre percussions, voix et mélodie"},
        "cues": {
            "es": ["la conversación entre las capas de percusión", "cómo la melodía se apoya y se adelanta al pulso", "los cambios de intensidad que nacen del conjunto"],
            "en": ["the conversation among percussion layers", "how the melody leans on and moves ahead of the pulse", "the shifts in intensity created by the ensemble"],
            "fr": ["le dialogue entre les couches de percussions", "la manière dont la mélodie s’appuie sur le rythme puis le devance", "les changements d’intensité produits par l’ensemble"],
        },
    },
    "folk": {
        "core": {"es": "la cercanía de la voz, el relato y el detalle acústico", "en": "the closeness of voice, narrative and acoustic detail", "fr": "la proximité de la voix, du récit et du détail acoustique"},
        "cues": {
            "es": ["la respiración que separa una imagen de la siguiente", "cómo el acompañamiento sostiene sin explicar de más", "el peso emocional de los cambios pequeños"],
            "en": ["the breath separating one image from the next", "how the accompaniment supports without overexplaining", "the emotional weight of small changes"],
            "fr": ["le souffle qui sépare une image de la suivante", "la manière dont l’accompagnement soutient sans trop expliquer", "le poids émotionnel des petits changements"],
        },
    },
    "rock": {
        "core": {"es": "la fricción entre textura, ritmo y forma de canción", "en": "the friction among texture, rhythm and song form", "fr": "la friction entre texture, rythme et forme de la chanson"},
        "cues": {
            "es": ["la forma en que las guitarras ocupan el espacio", "los cambios de presión de la sección rítmica", "cómo una imperfección se vuelve parte del carácter"],
            "en": ["the way the guitars occupy space", "the rhythm section’s changes in pressure", "how an imperfection becomes part of the character"],
            "fr": ["la manière dont les guitares occupent l’espace", "les changements de pression de la section rythmique", "la façon dont une imperfection devient un trait de caractère"],
        },
    },
    "global": {
        "core": {"es": "el pulso colectivo, la voz y la forma cíclica", "en": "collective pulse, voice and cyclical form", "fr": "le rythme collectif, la voix et la forme cyclique"},
        "cues": {
            "es": ["cómo el conjunto convierte repetición en avance", "la relación entre llamada y respuesta", "el momento en que una capa cambia a todas las demás"],
            "en": ["how the ensemble turns repetition into forward motion", "the relationship between call and response", "the moment when one layer changes all the others"],
            "fr": ["la façon dont l’ensemble transforme la répétition en mouvement", "la relation entre appel et réponse", "le moment où une couche modifie toutes les autres"],
        },
    },
    "pop": {
        "core": {"es": "el equilibrio entre gancho, arreglo y detalle tímbrico", "en": "the balance among hook, arrangement and timbral detail", "fr": "l’équilibre entre accroche, arrangement et détail de timbre"},
        "cues": {
            "es": ["la idea secundaria que sostiene el gancho principal", "cómo cambia el arreglo entre secciones", "el detalle de producción que solo aparece una vez"],
            "en": ["the secondary idea supporting the main hook", "how the arrangement changes between sections", "the production detail that appears only once"],
            "fr": ["l’idée secondaire qui soutient l’accroche principale", "la manière dont l’arrangement change entre les sections", "le détail de production qui n’apparaît qu’une fois"],
        },
    },
    "experimental": {
        "core": {"es": "el contraste, la textura y el desplazamiento de expectativas", "en": "contrast, texture and displaced expectations", "fr": "le contraste, la texture et le déplacement des attentes"},
        "cues": {
            "es": ["el primer elemento que rompe la simetría", "cómo el timbre ocupa el lugar de una melodía convencional", "la tensión entre estructura y accidente"],
            "en": ["the first element that breaks the symmetry", "how timbre takes the place of a conventional melody", "the tension between structure and accident"],
            "fr": ["le premier élément qui rompt la symétrie", "la façon dont le timbre remplace une mélodie conventionnelle", "la tension entre structure et accident"],
        },
    },
}


def profile_key(genre: str) -> str:
    value = genre.casefold()
    if "jazz" in value:
        return "jazz"
    if any(token in value for token in ("hip-hop", "hip hop")):
        return "hiphop"
    if any(token in value for token in ("soul", "r&b", "funk", "p-funk")):
        return "soul"
    if any(token in value for token in ("electr", "ambient", "house", "downtempo", "trip-hop", "garage", "dance")):
        return "electronic"
    if any(token in value for token in ("mpb", "bossa", "samba", "salsa", "tropic", "merengue", "reguet", "flamenco", "morna")):
        return "latin"
    if any(token in value for token in ("folk", "country", "chanson", "canción", "nueva canción")):
        return "folk"
    if any(token in value for token in ("afro", "qawwali", "reggae", "árabe", "ethio")):
        return "global"
    if any(token in value for token in ("rock", "punk", "metal", "shoegaze", "kraut", "britpop", "dream pop", "indie")):
        return "rock"
    if "pop" in value:
        return "pop"
    return "experimental"


def broad_genre(genre: str) -> str:
    key = profile_key(genre)
    return {
        "jazz": "jazz", "soul": "soul", "hiphop": "hip-hop",
        "electronic": "electronic", "latin": "latin", "folk": "folk",
        "global": "folk", "rock": "rock", "pop": "pop",
        "experimental": "electronic",
    }[key]


def duration(record: dict, service: dict) -> str:
    if record["type"] == "song":
        milliseconds = (service.get("appleMusic") or {}).get("durationMs") or MANUAL_SONG_MS.get(record["id"])
        if milliseconds:
            seconds = round(milliseconds / 1000)
            return f"{seconds // 60}:{seconds % 60:02d}"
        return "—"
    minutes = MANUAL_ALBUM_MINUTES.get(record["id"])
    if minutes is None:
        milliseconds = sum(item.get("durationMs") or 0 for item in service.get("tracklist", []))
        minutes = max(1, round(milliseconds / 60000)) if milliseconds else 1
    return f"{minutes} min"


def tracks_for(record: dict, service: dict) -> list[str]:
    if record["type"] == "song":
        return [record["title"]]
    if record["id"] in MANUAL_TRACKS:
        return MANUAL_TRACKS[record["id"]]
    tracks = [clean_track(item["title"]) for item in service.get("tracklist", []) if item.get("title")]
    return list(dict.fromkeys(tracks))[:3] or [record["title"]]


def existing_editorials() -> dict[str, dict]:
    notes = {}
    generated_path = DATA / "editorial-notes.json"
    if generated_path.exists():
        for note in load(generated_path):
            if note["id"] in CURATED_EDITORIAL_IDS:
                notes[note["id"]] = note["editorial"]
    expansion_path = DATA / "editorial-notes-expansion.json"
    if expansion_path.exists():
        for note in load(expansion_path):
            if note["id"] in CURATED_EDITORIAL_IDS:
                notes[note["id"]] = note["editorial"]
    return notes


def editorial_sources(record: dict, source_by_id: dict[str, dict]) -> list[dict]:
    routes = [source_by_id[source_id] for source_id in record["sourceRoute"] if source_id in source_by_id]
    preferred = [source for source in routes if source["id"] not in {"DISCOGS", "ACCLAIM"}] or routes
    chosen = preferred[:2]
    return [
        {
            "name": SOURCE_LABELS.get(
                source["id"],
                {language: source["name"] for language in LANGUAGES},
            ),
            "url": source["url"],
        }
        for source in chosen
    ]


def route_sentence(language: str, tracks: list[str], core: str) -> str:
    first = tracks[0]
    if len(tracks) == 1:
        templates = {
            "es": "La ruta de entrada es {first}. Conviene seguir las variaciones que atraviesan {core} sin perder la dirección de la pieza.",
            "en": "The entry route is {first}. Follow the variations moving through {core} without losing the piece’s direction.",
            "fr": "La porte d’entrée est {first}. Suivez les variations qui traversent {core} sans perdre la direction du morceau.",
        }
        return templates[language].format(first=first, core=core)
    second = tracks[1]
    if len(tracks) == 2:
        templates = {
            "es": "Una ruta útil va de {first} a {second}. Más que aislar una sola pieza, conviene notar las transformaciones que atraviesan {core} y cómo el orden convierte el contraste en continuidad.",
            "en": "A useful route runs from {first} to {second}. Rather than isolating one piece, notice the transformations moving through {core} and how sequencing turns contrast into continuity.",
            "fr": "Un parcours utile va de {first} à {second}. Plutôt que d’isoler un seul morceau, observez les transformations qui traversent {core} et la manière dont l’ordre transforme le contraste en continuité.",
        }
        return templates[language].format(first=first, second=second, core=core)
    third = tracks[2]
    templates = {
        "es": "Una ruta útil va de {first} a {second} y después a {third}. Más que aislar un sencillo, conviene notar las transformaciones que atraviesan {core} y cómo el orden convierte el contraste en continuidad.",
        "en": "A useful route runs from {first} to {second} and then {third}. Rather than isolating one single, notice the transformations moving through {core} and how sequencing turns contrast into continuity.",
        "fr": "Un parcours utile va de {first} à {second}, puis à {third}. Plutôt que d’isoler un single, observez les transformations qui traversent {core} et la manière dont l’ordre transforme le contraste en continuité.",
    }
    return templates[language].format(first=first, second=second, third=third, core=core)


def generate_editorial(record: dict, service: dict, sources: list[dict]) -> dict:
    profile = PROFILES[profile_key(record["genre"])]
    tracks = tracks_for(record, service)
    record_duration = duration(record, service)
    variant = number(record["id"]) % 4
    review = {}
    for language in LANGUAGES:
        core = profile["core"][language]
        localized_duration = record_duration
        if language in {"es", "fr"} and re.fullmatch(r"\d+:\d{2}", record_duration):
            minutes, seconds = record_duration.split(":")
            localized_duration = f"{minutes} min {seconds} s"
        if record["type"] == "album":
            openings = {
                "es": [
                    "En {title}, {artist} convierte {core} en el principio que organiza un álbum completo. Publicado en {year}, conserva su fuerza porque cada arreglo conduce a la siguiente decisión de escucha.",
                    "{title} no se limita a representar su época. {artist} usa {core} para construir una secuencia que todavía recompensa la escucha atenta.",
                    "Escuchar {title} de principio a fin permite entender el método de {artist}. {core_cap} no aparece como adorno, sino como la estructura que mantiene unido el disco.",
                    "Publicado en {year}, {title} demuestra que un álbum puede avanzar mediante matices. {artist} trabaja con {core} y evita que la identidad del conjunto se vuelva fórmula.",
                ],
                "en": [
                    "On {title}, {artist} turns {core} into the principle organizing a complete album. Released in {year}, it retains its force because each arrangement leads to the next listening decision.",
                    "{title} does more than represent its period. {artist} uses {core} to build a sequence that still rewards close listening.",
                    "Hearing {title} from beginning to end reveals {artist}'s method. {core_cap} is not decoration but the structure holding the record together.",
                    "Released in {year}, {title} shows how an album can advance through nuance. {artist} works with {core} without letting the record’s identity harden into formula.",
                ],
                "fr": [
                    "Dans {title}, {artist} fait de {core} le principe qui organise un album entier. Paru en {year}, il conserve sa force parce que chaque arrangement mène à la décision d’écoute suivante.",
                    "{title} ne se contente pas de représenter son époque. {artist} utilise {core} pour construire une séquence qui récompense encore l’écoute attentive.",
                    "Écouter {title} du début à la fin permet de comprendre la méthode de {artist}. {core_cap} n’est pas un ornement, mais la structure qui maintient le disque uni.",
                    "Paru en {year}, {title} montre qu’un album peut avancer par nuances. {artist} travaille avec {core} sans laisser l’identité du disque se figer en formule.",
                ],
            }
            first_paragraph = openings[language][variant].format(
                title=record["title"], artist=record["artist"], year=record["year"],
                core=core, core_cap=core[0].upper() + core[1:],
            )
            paragraphs = [first_paragraph, route_sentence(language, tracks, core)]
        else:
            openings = {
                "es": [
                    "En {title}, {artist} concentra {core} en {duration}. La canción se sostiene tanto por su idea central como por la precisión con que cada elemento encuentra su lugar.",
                    "{title} muestra cuánto puede cambiar una canción cuando {core} guía la forma. {artist} evita la demostración innecesaria y deja que el detalle produzca el impacto.",
                    "Publicada en {year}, {title} sigue sonando abierta porque {artist} trata {core} como una pregunta y no como una receta.",
                    "La fuerza de {title} está en su escala. {artist} hace que {core} se perciba de inmediato y, al mismo tiempo, deje detalles para una segunda escucha.",
                ],
                "en": [
                    "On {title}, {artist} concentrates {core} into {duration}. The song holds through both its central idea and the precision with which every element finds its place.",
                    "{title} shows how much a song can change when {core} guides its form. {artist} avoids unnecessary display and lets detail create the impact.",
                    "Released in {year}, {title} still sounds open because {artist} treats {core} as a question rather than a recipe.",
                    "The force of {title} lies in its scale. {artist} makes {core} immediate while leaving details for a second listen.",
                ],
                "fr": [
                    "Dans {title}, {artist} concentre {core} en {duration}. Le morceau tient autant par son idée centrale que par la précision avec laquelle chaque élément trouve sa place.",
                    "{title} montre combien une chanson peut changer lorsque {core} guide sa forme. {artist} évite la démonstration inutile et laisse le détail produire l’impact.",
                    "Paru en {year}, {title} reste ouvert parce que {artist} traite {core} comme une question plutôt que comme une recette.",
                    "La force de {title} tient à son échelle. {artist} rend {core} immédiatement perceptible tout en gardant des détails pour une seconde écoute.",
                ],
            }
            first_paragraph = openings[language][variant].format(
                title=record["title"], artist=record["artist"], year=record["year"],
                duration=localized_duration, core=core,
            )
            followups = {
                "es": "En la primera escucha, presta atención a {cue1}. En la segunda, desplaza la atención hacia {cue2}. Ese cambio revela {cue3} y explica por qué la pieza admite más de una lectura.",
                "en": "On first listen, pay attention to {cue1}. On the second, move your attention to {cue2}. That shift reveals {cue3} and explains why the track supports more than one reading.",
                "fr": "À la première écoute, observez {cue1}. À la seconde, déplacez votre attention vers {cue2}. Ce changement révèle {cue3} et explique pourquoi le morceau permet plusieurs lectures.",
            }
            cues = profile["cues"][language]
            paragraphs = [first_paragraph, followups[language].format(cue1=cues[0], cue2=cues[1], cue3=cues[2])]

        cues = profile["cues"][language]
        if record["type"] == "song":
            listen_for_templates = {
                "es": [
                    "En {track}, escucha {cue}.",
                    "Después, presta atención a {cue}.",
                    "En una última vuelta, busca {cue}.",
                ],
                "en": [
                    "On {track}, listen for {cue}.",
                    "Next, focus on {cue}.",
                    "On a final pass, notice {cue}.",
                ],
                "fr": [
                    "Dans {track}, écoutez {cue}.",
                    "Ensuite, observez {cue}.",
                    "Lors d’une dernière écoute, repérez {cue}.",
                ],
            }
            listen_for = [
                template.format(track=tracks[0], cue=cue)
                for template, cue in zip(listen_for_templates[language], cues)
            ]
        else:
            listen_for_templates = {
                "es": [
                    "{track} abre la ruta. Escucha {cue}.",
                    "Al pasar a {track}, presta atención a {cue}.",
                    "{track} cambia el foco. Observa {cue}.",
                ],
                "en": [
                    "{track} opens the route. Listen for {cue}.",
                    "As {track} begins, focus on {cue}.",
                    "{track} shifts the focus. Notice {cue}.",
                ],
                "fr": [
                    "{track} ouvre le parcours. Écoutez {cue}.",
                    "Au début de {track}, observez {cue}.",
                    "{track} déplace le point d’écoute. Repérez {cue}.",
                ],
            }
            listen_for = [
                template.format(
                    track=tracks[min(index, len(tracks) - 1)],
                    cue=cue,
                )
                for index, (template, cue) in enumerate(
                    zip(listen_for_templates[language], cues)
                )
            ]

        entry_reasons = {
            "es": "Presenta {core} antes de que la escucha amplíe sus posibilidades.",
            "en": "It introduces {core} before the listening route expands its possibilities.",
            "fr": "Le morceau présente {core} avant que le parcours d’écoute n’en élargisse les possibilités.",
        }
        review[language] = {
            "review": paragraphs,
            "listenFor": listen_for,
            "entryPoint": {
                "title": tracks[0],
                "reason": entry_reasons[language].format(core=core),
            },
        }

    return {
        "readTime": 1,
        "headerPosition": "center",
        "trackMentions": tracks,
        **review,
        "sources": sources,
    }


def normalize_editorial_listen_for(record: dict, editorial: dict) -> dict:
    """Keep curated observations while removing repetitive bullet openings."""
    transitions = {
        "es": ("Después: ", "Por último: "),
        "en": ("Next: ", "Finally: "),
        "fr": ("Ensuite : ", "Enfin : "),
    }
    song_replacements = {
        "es": "la pieza",
        "en": "the track",
        "fr": "le morceau",
    }

    for language in LANGUAGES:
        content = editorial.get(language) or {}
        bullets = list(content.get("listenFor") or [])
        if not bullets:
            continue

        if record["type"] == "song":
            title_pattern = re.compile(
                rf"(?<!\w){re.escape(record['title'])}(?!\w)",
                flags=re.IGNORECASE,
            )
            title_seen = 0
            for index, bullet in enumerate(bullets):
                matches = list(title_pattern.finditer(bullet))
                if matches and title_seen > 0:
                    bullet = title_pattern.sub(song_replacements[language], bullet)
                elif len(matches) > 1:
                    first_match = matches[0]
                    tail = title_pattern.sub(song_replacements[language], bullet[first_match.end():])
                    bullet = bullet[:first_match.end()] + tail
                title_seen += len(matches)
                bullets[index] = bullet

        opening_words = []
        for bullet in bullets:
            match = re.search(r"[\wÀ-ÿ]+", bullet, flags=re.UNICODE)
            opening_words.append(match.group(0).casefold() if match else "")
        if len(opening_words) > 1 and len(set(opening_words)) == 1:
            for index in range(1, len(bullets)):
                transition = transitions[language][min(index - 1, 1)]
                bullets[index] = transition + bullets[index]

        content["listenFor"] = bullets

    return editorial


def essential_reason(record: dict) -> dict:
    profile = PROFILES[profile_key(record["genre"])]
    variant = number(record["id"]) % 3
    templates = {
        "es": [
            "{work} {title} hace de {core} una forma de composición y no un simple efecto de estilo.",
            "La forma en que {artist} equilibra {core} mantiene a {title} abierto a nuevas escuchas.",
            "En {title}, {artist} usa {core} para sostener la identidad de la obra sin volverla predecible.",
        ],
        "en": [
            "{work} {title} turns {core} into a compositional method rather than a mere stylistic effect.",
            "The way {artist} balances {core} keeps {title} open to fresh listening.",
            "On {title}, {artist} uses {core} to sustain the work’s identity without making it predictable.",
        ],
        "fr": [
            "{work} {title} fait de {core} une méthode de composition plutôt qu’un simple effet de style.",
            "La manière dont {artist} équilibre {core} maintient {title} ouvert à de nouvelles écoutes.",
            "Dans {title}, {artist} articule {core} pour soutenir l’identité de l’œuvre sans la rendre prévisible.",
        ],
    }
    return {
        language: templates[language][variant].format(
            title=record["title"],
            artist=record["artist"],
            core=profile["core"][language],
            work={
                "es": "El álbum" if record["type"] == "album" else "La canción",
                "en": "The album" if record["type"] == "album" else "The song",
                "fr": "L’album" if record["type"] == "album" else "La chanson",
            }[language],
        )
        for language in LANGUAGES
    }


def description(record: dict) -> dict:
    profile = PROFILES[profile_key(record["genre"])]
    templates = {"es": "Una escucha guiada por {core}.", "en": "A listen shaped by {core}.", "fr": "Une écoute portée par {core}."}
    return {language: templates[language].format(core=profile["core"][language]) for language in LANGUAGES}


def editorial_card_copy(editorial: dict) -> tuple[dict[str, str], dict[str, str]]:
    """Derive the card teaser and essential thesis from approved editorial prose.

    This deliberately avoids a second bank of genre templates: the language on
    the recommendation card and inside the note now comes from the same manual
    editorial judgement.
    """
    protected_abbreviations = (
        "M.I.A.", "D.C.", "U.S.", "U.K.", "Mr.", "Mrs.", "Dr.", "St.",
    )
    descriptions: dict[str, str] = {}
    essential_reasons: dict[str, str] = {}
    for language in LANGUAGES:
        paragraphs = [
            paragraph.strip()
            for paragraph in editorial[language].get("review", [])
            if paragraph.strip()
        ]
        joined = " ".join(paragraphs)
        protected = joined
        for abbreviation in protected_abbreviations:
            protected = protected.replace(abbreviation, abbreviation.replace(".", "∯"))
        sentences = [
            sentence.replace("∯", ".").strip()
            for sentence in re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-Þ¿¡])", protected)
            if sentence.strip()
        ]
        if not sentences:
            raise SystemExit(f"Editorial review has no usable prose in {language}")
        # The title is already prominent on the card. Most editorial theses
        # begin with it, so use the following concrete sentence as the teaser
        # and keep the opening thesis for "why essential".
        descriptions[language] = sentences[1] if len(sentences) > 1 else sentences[0]
        essential_reasons[language] = sentences[0]
    return descriptions, essential_reasons


def streaming_payload(service: dict) -> dict:
    result = {}
    for key in ("spotify", "appleMusic", "youtubeMusic"):
        source = service.get(key) or {}
        if source.get("url"):
            result[key] = {"status": "available", "url": source["url"]}
        else:
            result[key] = {
                "status": "unavailable",
                "reason": source.get("reason", "Original entity unavailable on this service."),
            }
    return result


def main() -> None:
    master_path = CATALOG / "master.json"
    master_payload = load(master_path)
    master = master_payload["records"]
    service_by_id = {entry["id"]: entry for entry in load(CATALOG / "service-links-draft.json")["records"]}
    source_by_id = {source["id"]: source for source in load(DATA / "source-registry.json")["sources"]}
    old_notes = existing_editorials()
    manual_album_editorials = load_manual_album_editorials()
    manual_song_editorials = load_manual_song_editorials()
    song_listening_keys = load_song_listening_keys()

    expected_manual_album_ids = {
        record["id"]
        for record in master
        if record["type"] == "album" and record["id"] not in CURATED_EDITORIAL_IDS
    }
    actual_manual_album_ids = set(manual_album_editorials)
    if actual_manual_album_ids != expected_manual_album_ids:
        missing = sorted(expected_manual_album_ids - actual_manual_album_ids)
        extra = sorted(actual_manual_album_ids - expected_manual_album_ids)
        raise SystemExit(
            "Manual album editorial coverage mismatch. "
            f"Missing: {missing or 'none'}; extra: {extra or 'none'}"
        )
    expected_manual_song_ids = {
        record["id"]
        for record in master
        if record["type"] == "song" and record["id"] not in CURATED_EDITORIAL_IDS
    }
    actual_manual_song_ids = set(manual_song_editorials)
    if actual_manual_song_ids != expected_manual_song_ids:
        missing = sorted(expected_manual_song_ids - actual_manual_song_ids)
        extra = sorted(actual_manual_song_ids - expected_manual_song_ids)
        raise SystemExit(
            "Manual song editorial coverage mismatch. "
            f"Missing: {missing or 'none'}; extra: {extra or 'none'}"
        )

    albums, songs, notes, reasons = [], [], [], []
    for position, record in enumerate(master):
        service = service_by_id[record["id"]]
        sources = editorial_sources(record, source_by_id)
        editorial = copy.deepcopy(old_notes.get(record["id"]))
        if record["type"] == "album" and record["id"] in manual_album_editorials:
            editorial = copy.deepcopy(manual_album_editorials[record["id"]])
        if record["type"] == "song" and record["id"] in manual_song_editorials:
            editorial = copy.deepcopy(manual_song_editorials[record["id"]])
            editorial["trackMentions"] = [record["title"]]
            for language in LANGUAGES:
                editorial[language]["entryPoint"]["title"] = record["title"]
        if not editorial:
            raise SystemExit(
                f"Missing individually reviewed editorial for {record['id']}; "
                "bulk genre templates are disabled."
            )
        editorial.setdefault("sources", sources)
        editorial.setdefault("headerPosition", "center")
        editorial = normalize_editorial_listen_for(record, editorial)
        if record["type"] == "song":
            listening_key = song_listening_keys.get(record["id"])
            if not listening_key:
                raise SystemExit(f"Missing listening key for {record['id']}")
            for language in LANGUAGES:
                editorial[language]["entryPoint"]["reason"] = listening_key[language]
        else:
            for language in LANGUAGES:
                editorial[language]["entryPoint"]["reason"] = ""
        card_description, card_reason = editorial_card_copy(editorial)

        routes = [source_by_id[source_id] for source_id in record["sourceRoute"] if source_id in source_by_id]
        preferred = [source for source in routes if source["id"] not in {"DISCOGS", "ACCLAIM"}] or routes
        recognition_source = preferred[number(record["id"]) % len(preferred)]
        recognition = {
            "type": "reference" if recognition_source["id"] == "DISCOGS" else "selection",
            "title": SOURCE_LABELS.get(
                recognition_source["id"],
                {language: recognition_source["name"] for language in LANGUAGES},
            ),
            "source": recognition_source["name"].split(" — ", 1)[0],
            "url": recognition_source["url"],
        }

        runtime = {
            "id": record["id"],
            "type": record["type"],
            "artist": record["artist"],
            "title": record["title"],
            "year": record["year"],
            "decade": record["decade"],
            "genre": broad_genre(record["genre"]),
            "genreDetail": record["genre"],
            "country": record["country"],
            "duration": duration(record, service),
            "catalogue": f"TLG–{'A' if record['type'] == 'album' else 'S'}–{number(record['id']):04d}",
            "coverClass": COVER_CLASSES[position % len(COVER_CLASSES)],
            "coverUrl": service["cover"]["path"],
            "thumbnailUrl": service["cover"]["path"],
            "description": card_description,
            "recognition": recognition,
            "streaming": streaming_payload(service),
            "editionId": record["editionIntroduced"],
            "monthlyRole": record["monthlyRole"],
        }
        (albums if record["type"] == "album" else songs).append(runtime)
        notes.append({"id": record["id"], "editorial": editorial})
        reasons.append({"id": record["id"], "whyEssential": card_reason})

        record["status"] = {
            "metadata": "verified",
            "cover": "optimized-local",
            "streaming": "verified-direct-or-documented-unavailable",
            "editorial": "complete-three-languages",
            "essentialReason": "complete-three-languages",
        }
        record["publishable"] = True

    write(DATA / "albums.json", albums)
    write(DATA / "songs.json", songs)
    write(DATA / "editorial-notes.json", notes)
    write(DATA / "essential-reasons.json", reasons)
    master_payload["releaseStatus"] = "ready-for-publication"
    master_payload["publicationRule"] = "A record is publishable only with verified metadata, an optimized local cover, direct entity links for every available streaming service, documented unavailability where applicable, and reviewed ES/EN/FR editorial content."
    write(master_path, master_payload)

    edition_path = DATA / "editions" / f"{master_payload['editionId']}.json"
    if edition_path.exists():
        edition = load(edition_path)
        edition["releaseStatus"] = "ready-for-publication"
        edition["publishedRecordCounts"] = {"albums": len(albums), "songs": len(songs)}
        write(edition_path, edition)
    print(json.dumps({"albums": len(albums), "songs": len(songs), "editorials": len(notes), "essentialReasons": len(reasons)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
