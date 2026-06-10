from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password, create_access_token
from app.repositories.user import UserRepository
from app.schemas.schemas import RegistroRequest, LoginRequest, TokenResponse, UsuarioResponse, HogarResponse


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def registrar(self, schema: RegistroRequest) -> TokenResponse:
        """Registra un nuevo hogar con su primer usuario y devuelve la sesión iniciada."""
        existente = await self.user_repo.get_by_email(schema.email)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El email indicado ya está registrado. Inicia sesión o usa otro email."
            )

        usuario, hogar = await self.user_repo.create_with_hogar(
            nombre_hogar=schema.nombre_hogar,
            nombre=schema.nombre,
            email=schema.email,
            hashed_password=hash_password(schema.password)
        )
        return self._build_token_response(usuario, hogar)

    async def login(self, schema: LoginRequest) -> TokenResponse:
        """Valida credenciales y devuelve un token de acceso JWT."""
        usuario = await self.user_repo.get_by_email(schema.email)
        # Mensaje idéntico para email inexistente y contraseña errónea:
        # no revelar si una cuenta existe (enumeración de usuarios).
        if not usuario or not verify_password(schema.password, usuario.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        # usuario.hogar viene cargado eager desde el repositorio (selectinload)
        return self._build_token_response(usuario, usuario.hogar)

    def _build_token_response(self, usuario, hogar) -> TokenResponse:
        token = create_access_token(usuario_id=usuario.id, hogar_id=usuario.hogar_id)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            usuario=UsuarioResponse.model_validate(usuario),
            hogar=HogarResponse.model_validate(hogar)
        )
