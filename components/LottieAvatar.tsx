import React from 'react';
import Lottie from 'lottie-react';

interface LottieAvatarProps {
  animationPath: string;
  width?: number;
  height?: number;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
}

const LottieAvatar: React.FC<LottieAvatarProps> = ({ 
  animationPath, 
  width = 80, 
  height = 80, 
  className = '',
  loop = true,
  autoplay = true
}) => {
  const [animationData, setAnimationData] = React.useState<any>(null);
  const [error, setError] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Load the Lottie JSON file
    fetch(animationPath)
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(err => {
        console.error('Failed to load Lottie animation:', err);
        setError(true);
      });
  }, [animationPath]);

  if (error || !animationData) {
    // Fallback to a placeholder or return null
    return (
      <div 
        className={`${className} flex items-center justify-center bg-neon-green/10 rounded-full`}
        style={{ width, height }}
      >
        <span className="text-neon-green text-xs">⚡</span>
      </div>
    );
  }

  return (
    <div className={className} style={{ width, height }}>
      <Lottie 
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default LottieAvatar;
