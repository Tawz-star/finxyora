'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import RegistrationDetailsView from '@/components/RegistrationDetailsView';

export default function ConfirmationReceiptPage() {
  const params = useParams();
  const referenceId = (params?.referenceId as string) || '';

  return <RegistrationDetailsView referenceId={referenceId} source="confirmation" />;
}
