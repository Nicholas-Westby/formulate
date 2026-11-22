namespace Formulate.Extensions.SendData
{
    /// <summary>
    /// Constants for the Send Data extension.
    /// </summary>
    public static partial class Constants
    {
        /// <summary>
        /// The name of the <see cref="System.Net.Http.HttpClient"/> the Send Data handler sends with. A site can
        /// configure it with <c>AddHttpClient("Formulate.SendData")</c>, such as a proxy or a client certificate. A
        /// site that replaces the primary handler must keep a <see cref="System.Net.Http.SocketsHttpHandler"/>
        /// with <c>AllowAutoRedirect = false</c> (the data would follow a redirect to a URL the site owner did not
        /// choose) and <c>UseCookies = false</c> (the handler is shared between visitors' requests), or it undoes
        /// both safeguards.
        /// </summary>
        public const string HttpClientName = "Formulate.SendData";

        /// <summary>
        /// The transmission formats.
        /// </summary>
        public static class TransmissionFormats
        {
            public const string QueryString = "Query String";

            public const string FormBody = "Form Body";

            public const string Json = "JSON";

            public const string HubSpotJson = "HubSpot JSON";
        }
    }
}
