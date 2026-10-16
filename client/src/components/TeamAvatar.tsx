import { getTeamInitials } from '../utils/imageCompressor';

interface TeamAvatarProps {
  avatar?: string | null;
  teamName: string;
  size?: number;
  className?: string;
}

export function TeamAvatar({ avatar, teamName, size = 54, className }: TeamAvatarProps) {
  const isImage = avatar && (avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/'));

  if (isImage) {
    return (
      <div
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.round(size * 0.32)}px`,
          overflow: 'hidden',
          border: '2px solid rgba(255, 101, 25, 0.5)',
          boxShadow: '0 4px 14px rgba(255, 101, 25, 0.25)',
          flexShrink: 0,
          background: '#0e1626'
        }}
      >
        <img
          src={avatar}
          alt={teamName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      </div>
    );
  }

  // Si no es imagen (o si es un emoji heredado o está vacío)
  const isEmoji = avatar && avatar.length <= 4 && !avatar.startsWith('http') && !avatar.startsWith('data');
  const initials = getTeamInitials(teamName);

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.32)}px`,
        background: 'linear-gradient(135deg, #ff6519 0%, #b43a05 100%)',
        border: '2px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 4px 14px rgba(255, 101, 25, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: isEmoji ? `${Math.round(size * 0.48)}px` : `${Math.round(size * 0.38)}px`,
        flexShrink: 0,
        letterSpacing: '-0.02em',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
      }}
    >
      {isEmoji ? avatar : initials}
    </div>
  );
}
