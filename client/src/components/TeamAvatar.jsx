// Deterministic color from team name — same name always gets same color
const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
  'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-yellow-500', 'bg-cyan-500',
];

function colorFor(name) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const SIZE_CLASSES = {
  xs:  'w-5 h-5 text-[8px]',
  sm:  'w-7 h-7 text-[10px]',
  md:  'w-9 h-9 text-xs',
  lg:  'w-12 h-12 text-sm',
  xl:  'w-16 h-16 text-base',
};

export default function TeamAvatar({ avatarUrl, teamName, size = 'md', className = '' }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={teamName || 'Team avatar'}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-gray-700 ${className}`}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling?.style.removeProperty('display'); }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${colorFor(teamName)} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      title={teamName}
    >
      {initials(teamName)}
    </div>
  );
}
