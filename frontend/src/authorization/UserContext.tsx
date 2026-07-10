import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { API_URL } from '../config';

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mdconf_user');

    if (!saved) {
      setIsLoading(false);
      return;
    }

    const savedUser = JSON.parse(saved);
    setUserState(savedUser);

    // Подтягиваем актуальные данные с сервера (баллы, права админа могли измениться)
    fetch(`${API_URL}/api/user/${savedUser.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((freshData) => {
        if (freshData) {
          const updatedUser = { ...savedUser, ...freshData };
          setUserState(updatedUser);
          localStorage.setItem('mdconf_user', JSON.stringify(updatedUser));
        }
      })
      .catch(() => {
        // сервер недоступен — остаёмся с данными из localStorage
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('mdconf_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('mdconf_user');
    }
  };

  const logout = () => setUser(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Загрузка...</span>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser должен использоваться внутри UserProvider');
  return context;
}