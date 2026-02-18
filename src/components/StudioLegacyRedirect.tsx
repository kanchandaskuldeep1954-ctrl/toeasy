import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

interface StudioLegacyRedirectProps {
  panel: string;
}

const StudioLegacyRedirect: React.FC<StudioLegacyRedirectProps> = ({ panel }) => {
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set('panel', panel);
  return <Navigate to={`/app/studio?${nextParams.toString()}`} replace />;
};

export default StudioLegacyRedirect;
