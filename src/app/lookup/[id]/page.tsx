'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import RegistrationDetailsView from '@/components/RegistrationDetailsView';

export default function LookupDetailsPage() {
  const params = useParams();
  const id = (params?.id as string) || '';

  return <RegistrationDetailsView referenceId={id} source="lookup" />;
}
