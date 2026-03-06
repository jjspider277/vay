import React from 'react';
import App from './App';
import CreateTrip from './CreateTrip';
import SimulateClientTrip from './SimulateClientTrip';

const AppRouter: React.FC = () => {
  const path = window.location.pathname;

  if (path === '/create-trip') {
    return <CreateTrip />;
  }

  if (path === '/simulate-trip') {
    return <SimulateClientTrip />;
  }

  return <App />;
};

export default AppRouter;
