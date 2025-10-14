
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy static files
COPY public/ /usr/share/nginx/html/

# Expose port
EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
