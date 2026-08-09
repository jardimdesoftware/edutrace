import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { TokenPayload } from './services/auth/decodeToken'
import { jwtDecode } from 'jwt-decode'
import { ADMIN, ESTUDANTE } from './consts'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const pathname = request.nextUrl.pathname

  const isLoginPage = pathname === '/'
  const isPublicPage = isLoginPage || pathname === '/forgot-password'
  const changePasswordPage = '/alterar-dados'

  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (token) {
    try {
      const payload = jwtDecode<TokenPayload>(token);

      const currentTime = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < currentTime) {
        const response = NextResponse.redirect(new URL('/', request.url));

        response.cookies.set('token', '', {
          path: '/',
          expires: new Date(0),
        });

        return response;
      }

      // A senha do primeiro acesso foi definida pelo administrador. Até que o
      // usuário troque, nenhuma outra tela fica acessível — o backend recusa as
      // demais rotas de qualquer forma.
      if (payload.must_change_password && pathname !== changePasswordPage) {
        return NextResponse.redirect(new URL(changePasswordPage, request.url));
      }

      if (isLoginPage) {
        return NextResponse.redirect(new URL('/home', request.url));
      }

      const isStudent = payload.id_level === ESTUDANTE;
      const isAdmin = payload.id_level === ADMIN;
      const restrictedPathsStudent = ['/visualizar', '/editar-anamnese', '/editar-pei', '/editar-triagem'];
      const tryingToAccessRestricted = restrictedPathsStudent.some(path =>
        pathname.startsWith(path)
      );

      if (isStudent && tryingToAccessRestricted) {
        return NextResponse.redirect(new URL('/home', request.url));
      }

      const adminOnlyPaths = ['/admin'];
      const tryingToAccessAdminOnly = adminOnlyPaths.some(path =>
        pathname.startsWith(path)
      );

      if (tryingToAccessAdminOnly && !isAdmin) {
        return NextResponse.redirect(new URL('/home', request.url));
      }

    } catch (error) {
      console.error('Erro ao decodificar token no middleware:', error);
        const response = NextResponse.redirect(new URL('/', request.url));
        response.cookies.set('token', '', {
          path: '/',
          expires: new Date(0),
        });
        return response;
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|assets|public|.*\\..*).*)'],
}
