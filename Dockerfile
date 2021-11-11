FROM node:12-slim

WORKDIR /code
COPY . .

RUN cd client && npm install && cd ../server && npm install
RUN npm run prepareSettings

EXPOSE 3000
EXPOSE 3210

ENTRYPOINT ["./entrypoint.sh"]