import React from 'react';
import { Container, Header, Content, Footer } from 'rsuite';
import TopBar from '../layout/TopBar';

const LandingPage = () => (
  <Container>
    <TopBar />
    <Header>
      <h2 style={{ textAlign: 'center' }}>Welcome to Carpaintr</h2>
    </Header>
    <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ textAlign: 'center' }}>
        <p>Your go-to solution for all car painting needs. We provide the best services to keep your car looking brand new!</p>
      </div>
    </Content>
    <Footer>
      <p style={{ textAlign: 'center' }}>© 2024 Carpaintr. All rights reserved.</p>
    </Footer>
  </Container>
);

export default LandingPage;
