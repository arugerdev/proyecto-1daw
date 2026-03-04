# front/Dockerfile

# Stage 1: Build the Angular application
FROM node:alpine AS build
WORKDIR /app

ARG API_URL=http://localhost:3000/api
ENV API_URL=$API_URL

RUN echo "export const environment = { production: true, API_URL: '${API_URL}' };" > src/environments/environment.ts

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve the application with Nginx
FROM nginx:alpine
COPY --from=build /app/dist/front/browser /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]