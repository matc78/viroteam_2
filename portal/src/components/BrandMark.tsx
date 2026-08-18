import Image from "next/image";
import { site } from "@/lib/site";

type BrandMarkProps = {
  className?: string;
  /** Taille d'affichage en pixels. */
  size?: number;
  priority?: boolean;
};

/** Pictogramme officiel ViroTeam. */
export function BrandMark({
  className,
  size = 32,
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src={site.logoMark}
      alt=""
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
