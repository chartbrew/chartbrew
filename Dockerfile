FROM node:14-slim

WORKDIR /code
COPY . .

RUN cd client && npm install && cd ../server && npm install
RUN npm run prepareSettings

EXPOSE 4018
EXPOSE 4019

ENTRYPOINT ["./entrypoint.sh"]
