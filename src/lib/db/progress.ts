export type SeedProgress = {
  label: string;
  current: number;
  total: number;
};

export type OnSeedProgress = (progress: SeedProgress) => void;

export function reportSeedProgress(
  onProgress: OnSeedProgress | undefined,
  label: string,
  current: number,
  total: number,
) {
  onProgress?.({ label, current, total });
}
