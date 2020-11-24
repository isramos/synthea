FROM smartonfhir/synthea

WORKDIR /synthea

EXPOSE 80

# Install the server
COPY package.json      /app/package.json
COPY package-lock.json /app/package-lock.json
COPY index.js          /app/index.js
RUN cd /app && npm i

# Force it to download gradle and other dependencies
# NOTE: This turns the resulting image into a snapshot of whatever the
# dependencies have resolved to at build time!
RUN /synthea/run_synthea
RUN rm -rf /synthea/output/*

CMD ["node", "/app/index.js"]
