import { getTeamInitials } from '../utils/imageCompressor';

interface TeamAvatarProps {
  avatar?: string | null;
  teamName: string;
  size?: number;
  className?: string;
}

/**
 * Escudo del equipo. Estilo plano: esquinas casi rectas, borde fino,
 * sin sombras ni brillos. Si no hay imagen, muestra las iniciales sobre azul RVC.
 */
export function TeamAvatar({ avatar, teamName, size = 54, className }: TeamAvatarProps) {
  const isImage = avatar && (avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/'));
  const radius = Math.max(3, Math.round(size * 0.08));

  if (isImage) {
    return (
      <div
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${radius}px`,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          flexShrink: 0,
          background: '#16191d'
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
        borderRadius: `${radius}px`,
        background: '#13233a',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: "'Barlow Condensed', 'Inter', sans-serif",
        fontWeight: 700,
        fontSize: isEmoji ? `${Math.round(size * 0.48)}px` : `${Math.round(size * 0.42)}px`,
        flexShrink: 0,
        letterSpacing: '0.02em'
      }}
    >
      {isEmoji ? avatar : initials}
    </div>
  );
}
