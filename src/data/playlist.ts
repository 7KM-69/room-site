// What the gramophone plays. The first track is the default; add more entries to grow the playlist.
// `src` is a file in public/audio/ (or a full https URL from a host that allows streaming it).

export type Track = {
  id: string
  title: string
  artist: string
  src: string
  credit?: string // shown nowhere yet; keep it for an about/credits page
}

const local = (file: string) => `${import.meta.env.BASE_URL}audio/${file}`

export const PLAYLIST: Track[] = [
  {
    id: 'gymnopedie-1',
    title: 'Gymnopédie No. 1',
    artist: 'Erik Satie',
    src: local('gymnopedie-1.mp3'),
    credit: 'Performed by Robin Alciatore, Musopen (public domain), via Wikimedia Commons',
  },
  { id: 'idea-10', title: 'Idea 10', artist: 'Gibran Alcocer', src: local('idea10.mp3') },
]

/** Playback settings shared by every track. */
export const PLAYBACK = {
  volume: 0.3, // soft, ambient
  fadeIn: 1.6, // seconds
  fadeOut: 0.9,
}
