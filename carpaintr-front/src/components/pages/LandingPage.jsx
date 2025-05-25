import React from 'react';
import { Container, Header, Content, Footer } from 'rsuite';
import TopBar from '../layout/TopBar';
import AutoLabLanding from './landing/Landing';

const LandingPage = () => (
  <Container>
    <TopBar />
    <AutoLabLanding />
  </Container>
);

export default LandingPage;
