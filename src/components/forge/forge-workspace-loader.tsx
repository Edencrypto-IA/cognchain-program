'use client';

import dynamic from 'next/dynamic';
import { ForgePageSkeleton } from './forge-page-skeleton';

const ForgeWorkspace = dynamic(
  () => import('@/features/forge/forge-workspace').then(module => ({ default: module.ForgeWorkspace })),
  { loading: () => <ForgePageSkeleton />, ssr: false },
);

export function ForgeWorkspaceLoader() {
  return <ForgeWorkspace />;
}
