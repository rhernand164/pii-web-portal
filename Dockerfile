FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy static files, including the new template
COPY public/ /usr/share/nginx/html/

# Expose port
EXPOSE 3001

# New CMD: Use 'envsubst' to substitute the environment variable into the template,
# creating the final app.js before starting nginx.
# Note: We specify the variable to prevent other '$' signs in the JS from being replaced.
CMD ["/bin/sh", "-c", "envsubst '${API_BASE_URL}' < /usr/share/nginx/html/app.js.template > /usr/share/nginx/html/app.js && nginx -g 'daemon off;'"]


