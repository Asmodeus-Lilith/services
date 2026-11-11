// App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { OrderProvider } from './context/OrderContext';
import { ToastProvider } from './context/ToastContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminOrders from './pages/AdminOrders';
import AdminModeration from './pages/AdminModeration';
import AdminPromotions from './pages/AdminPromotions';
import Wishlist from './pages/Wishlist';
import NotFound from './pages/NotFound';
import ProviderDashboard from './pages/ProviderDashboard';
import Messages from './pages/Messages';
import About from './pages/About';
import './App.css';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <AuthProvider>
      <CatalogProvider>
        <ToastProvider>
          <OrderProvider>
            <WishlistProvider>
              <NotificationProvider>
                <CartProvider>
              <Router>
                <div className="App">
                  <Navbar onSearch={setSearchTerm} searchTerm={searchTerm} />
                  <main className="main-content">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/services/:category" element={<Services />} />
                      <Route path="/service/:id" element={<ServiceDetail />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/wishlist" element={<Wishlist />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route
                        path="/order-confirmation/:id"
                        element={<OrderConfirmation />}
                      />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/orders"
                        element={
                          <ProtectedRoute allowedTypes={['admin']}>
                            <AdminOrders />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/moderation"
                        element={
                          <ProtectedRoute allowedTypes={['admin']}>
                            <AdminModeration />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/promotions"
                        element={
                          <ProtectedRoute allowedTypes={['admin']}>
                            <AdminPromotions />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/provider/dashboard"
                        element={
                          <ProtectedRoute allowedTypes={['provider']}>
                            <ProviderDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/messages"
                        element={
                          <ProtectedRoute allowedTypes={['customer', 'provider']}>
                            <Messages />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/about" element={<About />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                </div>
              </Router>
            </CartProvider>
              </NotificationProvider>
            </WishlistProvider>
          </OrderProvider>
        </ToastProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}

export default App;
